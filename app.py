# app.py
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import os
import argparse
import json
import base64
import re
import cv2
import numpy as np
from bosdyn.api.graph_nav import map_pb2
from bosdyn.client.math_helpers import SE3Pose
from io import BytesIO
from PIL import Image
from scipy import ndimage
from flask import Flask, send_from_directory
from bosdyn.api import image_pb2

app = Flask(__name__, static_folder='../spot-map-visualizer/build')
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')
    
class SpotMapAPI:
    """API class to handle GraphNav map data and provide endpoints for React frontend."""
    
    FRONT_CAMERA_SOURCES = {
        'left': 'frontright_fisheye_image',  
        'right': 'frontleft_fisheye_image'  
    }
    
    ROTATION_ANGLE = {
        'back_fisheye_image': 0,
        'frontleft_fisheye_image': -90,
        'frontright_fisheye_image': -90,
        'left_fisheye_image': 0,
        'right_fisheye_image': 180
    }

    def __init__(self, map_path, rag_path):
        """Initialize the API with map and RAG data."""
        self.map_path = map_path
        self.rag_db_path = rag_path
        self.snapshot_dir = os.path.join(self.map_path, "waypoint_snapshots")
        
        # Load data
        self.graph, self.waypoints, self.snapshots, self.anchors, self.anchored_world_objects = self.load_graph()
        
        # Compute global transforms
        self.global_transforms = self.compute_global_transforms()
        self.anchored_transforms = self.compute_anchored_transforms()
        
        # Load annotations and extract all objects
        self.waypoint_annotations = self.load_rag_annotations()
        self.all_objects = self.extract_all_objects()
        
        # Path for saving updated graph
        self.graph_file_path = os.path.join(self.map_path, "graph")
        
    def load_graph(self):
        """Load GraphNav map data including anchoring information."""
        with open(os.path.join(self.map_path, "graph"), "rb") as f:
            graph = map_pb2.Graph()
            graph.ParseFromString(f.read())
            
        waypoints = {waypoint.id: waypoint for waypoint in graph.waypoints}
        snapshots = {}
        anchors = {}
        anchored_world_objects = {}
        
        # Load snapshots
        for waypoint in graph.waypoints:
            if waypoint.snapshot_id:
                snapshot_path = os.path.join(self.snapshot_dir, waypoint.snapshot_id)
                if os.path.exists(snapshot_path):
                    with open(snapshot_path, "rb") as f:
                        snapshot = map_pb2.WaypointSnapshot()
                        snapshot.ParseFromString(f.read())
                        snapshots[snapshot.id] = snapshot

        # Load anchoring information
        for anchor in graph.anchoring.anchors:
            anchors[anchor.id] = anchor
            
        # Load anchored world objects
        for anchored_wo in graph.anchoring.objects:
            anchored_world_objects[anchored_wo.id] = anchored_wo
            
        return graph, waypoints, snapshots, anchors, anchored_world_objects
    
    def load_rag_annotations(self):
        """Load RAG annotations."""
        annotations = {}
        if not os.path.exists(self.rag_db_path):
            return annotations
            
        metadata_files = [f for f in os.listdir(self.rag_db_path) 
                         if f.startswith("metadata_") and f.endswith(".json")]
        
        for metadata_file in metadata_files:
            with open(os.path.join(self.rag_db_path, metadata_file)) as f:
                metadata = json.load(f)
                waypoint_id = metadata.get("waypoint_id")
                if waypoint_id:
                    annotations[waypoint_id] = metadata
                
        return annotations
    
    @staticmethod
    def _clean_text(text):
        "Remove articles, plurals, and lower-case"
        if not text:
            return ""
        text = re.sub(r'\b(a|an|the)\b', '', text)
        text = re.sub(r's\b', '', text)
        text = text.lower()
        return text
    
    def extract_all_objects(self):
        """Extract all unique objects from the annotations."""
        objects = set()
        
        for waypoint_id, ann in self.waypoint_annotations.items():
            if "views" in ann:
                for view_type, view_data in ann["views"].items():
                    visible_objects = view_data.get("visible_objects", [])
                    # Clean and normalize object names
                    cleaned_objects = [self._clean_text(obj) for obj in visible_objects]
                    objects.update(cleaned_objects)
        
        return sorted(list(objects))
    
    def compute_global_transforms(self):
        """Compute global transforms for all waypoints using BFS."""
        # Dictionary to store global transforms for each waypoint
        global_transforms = {}
        
        # Start BFS from the first waypoint
        queue = []
        visited = {}
        
        # Start with first waypoint and identity matrix
        first_waypoint = self.graph.waypoints[0]
        queue.append((first_waypoint, np.eye(4)))
        
        while len(queue) > 0:
            curr_element = queue[0]
            queue.pop(0)
            curr_waypoint = curr_element[0]
            world_tform_current = curr_element[1]
            
            if curr_waypoint.id in visited:
                continue
                
            visited[curr_waypoint.id] = True
            global_transforms[curr_waypoint.id] = world_tform_current
            
            # Process all edges
            for edge in self.graph.edges:
                # Handle forward edges
                if edge.id.from_waypoint == curr_waypoint.id and edge.id.to_waypoint not in visited:
                    to_waypoint = self.waypoints[edge.id.to_waypoint]
                    current_tform_to = SE3Pose.from_proto(edge.from_tform_to).to_matrix()
                    world_tform_to = np.dot(world_tform_current, current_tform_to)
                    queue.append((to_waypoint, world_tform_to))
                
                # Handle reverse edges
                elif edge.id.to_waypoint == curr_waypoint.id and edge.id.from_waypoint not in visited:
                    from_waypoint = self.waypoints[edge.id.from_waypoint]
                    current_tform_from = SE3Pose.from_proto(edge.from_tform_to).inverse().to_matrix()
                    world_tform_from = np.dot(world_tform_current, current_tform_from)
                    queue.append((from_waypoint, world_tform_from))
        
        return global_transforms
    
    def compute_anchored_transforms(self):
        """Compute transforms for waypoints using seed frame anchoring."""
        anchored_transforms = {}
        
        # Process each waypoint that has an anchor
        for waypoint_id, anchor in self.anchors.items():
            # Get the transform from seed frame to waypoint
            seed_tform_waypoint = SE3Pose.from_proto(anchor.seed_tform_waypoint).to_matrix()
            anchored_transforms[waypoint_id] = seed_tform_waypoint
        
        return anchored_transforms
    
    def get_map_data(self, use_anchoring=False):
        """Get the map data in a format suitable for frontend visualization."""
        # Choose which transforms to use
        transforms = self.anchored_transforms if use_anchoring else self.global_transforms
        
        waypoints_data = []
        edges_data = []
        objects_data = []
        
        # Process waypoints
        for waypoint in self.graph.waypoints:
            if waypoint.id not in transforms:
                continue
                
            # Get the transform for this waypoint
            world_transform = transforms[waypoint.id]
            position = world_transform[:3, 3]
            
            # Get rotation as quaternion for 3D visualization
            rotation_matrix = world_transform[:3, :3]
            # This is a simplified quaternion conversion - a proper implementation would use a library
            # like scipy.spatial.transform.Rotation or custom quaternion conversion code
            
            # Get waypoint data
            waypoint_data = {
                "id": waypoint.id,
                "position": [float(position[0]), float(position[1]), float(position[2])],
                "label": waypoint.annotations.name or "",
                "snapshot_id": waypoint.snapshot_id,
                "has_images": waypoint.snapshot_id in self.snapshots
            }
            
            # Add annotation data if available
            if waypoint.id in self.waypoint_annotations:
                objects = []
                ann = self.waypoint_annotations[waypoint.id]
                if "views" in ann:
                    for view_type, view_data in ann["views"].items():
                        visible = view_data.get("visible_objects", [])
                        for obj in visible:
                            clean_obj = self._clean_text(obj)
                            if clean_obj not in objects:
                                objects.append(clean_obj)
                
                waypoint_data["objects"] = objects
            
            waypoints_data.append(waypoint_data)
        
        # Process edges
        for edge in self.graph.edges:
            if edge.id.from_waypoint in transforms and edge.id.to_waypoint in transforms:
                from_transform = transforms[edge.id.from_waypoint]
                to_transform = transforms[edge.id.to_waypoint]
                from_pos = from_transform[:3, 3]
                to_pos = to_transform[:3, 3]
                
                edge_data = {
                    "id": f"{edge.id.from_waypoint}_{edge.id.to_waypoint}",
                    "from_id": edge.id.from_waypoint,
                    "to_id": edge.id.to_waypoint,
                    "from_position": [float(from_pos[0]), float(from_pos[1]), float(from_pos[2])],
                    "to_position": [float(to_pos[0]), float(to_pos[1]), float(to_pos[2])],
                }
                
                edges_data.append(edge_data)
        
        # Process anchored world objects if in anchoring mode
        if use_anchoring:
            for obj_id, anchored_obj in self.anchored_world_objects.items():
                seed_tform_obj = SE3Pose.from_proto(anchored_obj.seed_tform_object).to_matrix()
                position = seed_tform_obj[:3, 3]
                
                object_data = {
                    "id": obj_id,
                    "position": [float(position[0]), float(position[1]), float(position[2])],
                    "type": "anchor"
                }
                
                objects_data.append(object_data)
        
        return {
            "waypoints": waypoints_data,
            "edges": edges_data,
            "objects": objects_data,
            "use_anchoring": use_anchoring
        }
    
    def get_waypoint_images(self, waypoint_id):
        """Get the images for a specific waypoint."""
        if waypoint_id not in self.waypoints or not self.waypoints[waypoint_id].snapshot_id:
            return None
            
        snapshot_id = self.waypoints[waypoint_id].snapshot_id
        if snapshot_id not in self.snapshots:
            return None
        
        snapshot = self.snapshots[snapshot_id]
        images = {}
        
        for image in snapshot.images:
            # Process only front camera images
            if image.source.name == self.FRONT_CAMERA_SOURCES['left']:
                opencv_image, _ = self.convert_image_from_snapshot(
                    image.shot.image,
                    image.source.name
                )
                if opencv_image is not None:
                    images['left'] = self._encode_image_to_base64(opencv_image)
                    
            elif image.source.name == self.FRONT_CAMERA_SOURCES['right']:
                opencv_image, _ = self.convert_image_from_snapshot(
                    image.shot.image,
                    image.source.name
                )
                if opencv_image is not None:
                    images['right'] = self._encode_image_to_base64(opencv_image)
        
        return images
    
    def convert_image_from_snapshot(self, image_data, image_source, auto_rotate=True):
        """Convert an image from a GraphNav waypoint snapshot to an OpenCV image."""
        # Determine pixel format and number of channels
        num_channels = 1  # Default to 1 channel
        dtype = np.uint8  # Default to 8-bit unsigned integer

        # Determine pixel format
        if image_data.pixel_format == image_pb2.Image.PIXEL_FORMAT_DEPTH_U16:
            dtype = np.uint16
            extension = ".png"
        else:
            if image_data.pixel_format == image_pb2.Image.PIXEL_FORMAT_RGB_U8:
                num_channels = 3
            elif image_data.pixel_format == image_pb2.Image.PIXEL_FORMAT_RGBA_U8:
                num_channels = 4
            elif image_data.pixel_format == image_pb2.Image.PIXEL_FORMAT_GREYSCALE_U8:
                num_channels = 1
            elif image_data.pixel_format == image_pb2.Image.PIXEL_FORMAT_GREYSCALE_U16:
                num_channels = 1
                dtype = np.uint16
            extension = ".jpg"

        # Convert image data to numpy array
        img = np.frombuffer(image_data.data, dtype=dtype)

        # Reshape or decode the image
        if image_data.format == image_pb2.Image.FORMAT_RAW:
            try:
                # Attempt to reshape array into rows x cols x channels
                img = img.reshape((image_data.rows, image_data.cols, num_channels))
            except ValueError:
                # If reshaping fails, use OpenCV decode
                img = cv2.imdecode(img, -1)
        else:
            img = cv2.imdecode(img, -1)
        
        if auto_rotate:
            try:
                rotation_angle = self.ROTATION_ANGLE.get(image_source, 0)
                img = ndimage.rotate(img, rotation_angle)
            except KeyError:
                print(f"Warning: No rotation defined for source {image_source}")

        return img, extension
    
    def _encode_image_to_base64(self, cv_image):
        """Convert OpenCV image to base64 string with consistent compression."""
        try:
            # Check if image is grayscale (1 channel)
            if len(cv_image.shape) == 2 or (len(cv_image.shape) == 3 and cv_image.shape[2] == 1):
                # For grayscale, directly convert to PIL
                if len(cv_image.shape) == 3:
                    cv_image = cv_image.squeeze()  # Remove single-dimension
                image = Image.fromarray(cv_image, mode='L')
            else:
                # For color images, convert BGR to RGB
                image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
            
            buffered = BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            encoded = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            return encoded
            
        except Exception as e:
            print(f"Error in _encode_image_to_base64: {str(e)}")
            return None
    
    def update_waypoint_label(self, waypoint_id, new_label):
        """Update the label for a specific waypoint."""
        if waypoint_id not in self.waypoints:
            return False, "Waypoint not found"
        
        try:
            # Update the waypoint label
            self.waypoints[waypoint_id].annotations.name = new_label
            
            # Save the updated graph
            with open(self.graph_file_path, "wb") as f:
                f.write(self.graph.SerializeToString())
            
            return True, "Label updated successfully"
        except Exception as e:
            return False, f"Error updating label: {str(e)}"

# Initialize API instance
api_instance = None


@app.route('/api/map', methods=['GET'])
def get_map():
    """Get the map data with enhanced error handling."""
    try:
        print(f"Map path: {api_instance.map_path}")
        print(f"Number of waypoints: {len(api_instance.waypoints)}")
        print(f"Number of edges: {len(api_instance.graph.edges)}")
        
        use_anchoring = request.args.get('use_anchoring', 'false').lower() == 'true'
        print(f"Fetching map data with use_anchoring={use_anchoring}")
        
        data = api_instance.get_map_data(use_anchoring)
        print(f"Successfully retrieved map with {len(data['waypoints'])} waypoints")
        
        return jsonify(data)
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in get_map: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return jsonify({"error": str(e), "traceback": error_traceback}), 500

@app.route('/api/waypoints', methods=['GET'])
def get_waypoints():
    """Get a list of all waypoints with enhanced error handling."""
    try:
        waypoints = [
            {
                "id": wp.id, 
                "label": wp.annotations.name or "", 
                "has_snapshot": bool(wp.snapshot_id)
            } 
            for wp in api_instance.graph.waypoints
        ]
        print(f"Successfully retrieved {len(waypoints)} waypoints")
        return jsonify(waypoints)
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in get_waypoints: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return jsonify({"error": str(e), "traceback": error_traceback}), 500

@app.route('/api/waypoint/<waypoint_id>', methods=['GET'])
def get_waypoint(waypoint_id):
    """Get detailed information about a specific waypoint with enhanced error handling."""
    try:
        if waypoint_id not in api_instance.waypoints:
            print(f"Waypoint not found: {waypoint_id}")
            return jsonify({"error": "Waypoint not found"}), 404
        
        waypoint = api_instance.waypoints[waypoint_id]
        print(f"Retrieved waypoint: {waypoint_id}")
        
        # Get position in the selected coordinate frame
        use_anchoring = request.args.get('use_anchoring', 'false').lower() == 'true'
        transforms = api_instance.anchored_transforms if use_anchoring else api_instance.global_transforms
        
        position = None
        if waypoint_id in transforms:
            world_transform = transforms[waypoint_id]
            position = world_transform[:3, 3].tolist()
        
        # Get annotation data
        objects = []
        if waypoint_id in api_instance.waypoint_annotations:
            ann = api_instance.waypoint_annotations[waypoint_id]
            if "views" in ann:
                for view_type, view_data in ann["views"].items():
                    visible = view_data.get("visible_objects", [])
                    for obj in visible:
                        clean_obj = api_instance._clean_text(obj)
                        if clean_obj not in objects:
                            objects.append(clean_obj)
        
        result = {
            "id": waypoint_id,
            "label": waypoint.annotations.name or "",
            "snapshot_id": waypoint.snapshot_id,
            "position": position,
            "objects": objects
        }
        
        return jsonify(result)
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in get_waypoint: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return jsonify({"error": str(e), "traceback": error_traceback}), 500

@app.route('/api/check', methods=['GET'])
def check_api():
    """Simple endpoint to check if the API is working."""
    try:
        map_info = {
            "status": "ok",
            "map_path": api_instance.map_path,
            "waypoints_count": len(api_instance.waypoints),
            "edges_count": len(api_instance.graph.edges),
            "snapshots_count": len(api_instance.snapshots),
            "objects_count": len(api_instance.all_objects)
        }
        return jsonify(map_info)
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in check_api: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return jsonify({"error": str(e), "traceback": error_traceback}), 500

@app.route('/api/waypoint/<waypoint_id>/images', methods=['GET'])
def get_waypoint_images(waypoint_id):
    """Get the images for a specific waypoint."""
    images = api_instance.get_waypoint_images(waypoint_id)
    if images is None:
        return jsonify({"error": "Images not found"}), 404
    
    return jsonify(images)

@app.route('/api/objects', methods=['GET'])
def get_objects():
    """Get a list of all objects in the environment."""
    return jsonify(api_instance.all_objects)

@app.route('/api/waypoint/<waypoint_id>/label', methods=['PUT'])
def update_waypoint_label(waypoint_id):
    """Update the label for a specific waypoint."""
    data = request.json
    if not data or 'label' not in data:
        return jsonify({"error": "Missing label in request"}), 400
    
    success, message = api_instance.update_waypoint_label(waypoint_id, data['label'])
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"message": message})

def run_server(map_path, rag_path, port=5000):
    """Run the Flask server."""
    global api_instance
    api_instance = SpotMapAPI(map_path, rag_path)
    app.run(debug=True, port=port)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--map-path", type=str, default="./assets/maps/chair_v3")
    parser.add_argument("--rag-path", type=str, default="./assets/database/chair_v3")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()
    run_server(args.map_path, args.rag_path, args.port)