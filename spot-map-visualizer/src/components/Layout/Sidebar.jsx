// src/components/Layout/Sidebar.jsx
import React from 'react';
import './Sidebar.css';

const Sidebar = ({ children }) => {
  return (
    <div className="sidebar">
      {children}
    </div>
  );
};

export default Sidebar;
