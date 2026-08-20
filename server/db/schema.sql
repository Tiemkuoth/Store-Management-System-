-- MySQL Database Schema for Store Management System

CREATE DATABASE IF NOT EXISTS store_management_db;
USE store_management_db;

-- Roles: Administrator, Store Manager, Storekeeper, Auditor, Viewer
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  role ENUM('Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer') NOT NULL DEFAULT 'Storekeeper',
  status ENUM('Active', 'Inactive', 'Locked') DEFAULT 'Active',
  avatar_url MEDIUMTEXT,
  theme_preference ENUM('Light','Dark','System Default') NOT NULL DEFAULT 'Light',
  failed_login_attempts INT DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  force_password_change BOOLEAN DEFAULT FALSE,
  password_expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  status ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
  size_bytes BIGINT DEFAULT 0,
  type ENUM('Manual', 'Auto') DEFAULT 'Manual',
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Material Categories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees & Departments receiving materials
CREATE TABLE IF NOT EXISTS employees_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('Employee', 'Department') NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  department_name VARCHAR(100),
  contact_number VARCHAR(50),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materials / Items in Store
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INT,
  unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'Pcs',
  specifications TEXT,
  min_stock_level INT NOT NULL DEFAULT 5,
  current_stock INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  supplier_id INT,
  location VARCHAR(100) DEFAULT 'Main Warehouse',
  barcode VARCHAR(100),
  batch_number VARCHAR(100),
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Inventory Transactions (Stock In, Stock Out, Returns, Adjustments)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(50) UNIQUE NOT NULL,
  transaction_type ENUM('STOCK_IN', 'STOCK_OUT', 'RETURN', 'ADJUSTMENT') NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) DEFAULT 0.00,
  supplier_id INT,
  employee_dept_id INT,
  purpose VARCHAR(255),
  issued_by_id INT,
  approved_by_id INT,
  store_location VARCHAR(100) DEFAULT 'Main Warehouse',
  remarks TEXT,
  payment_method ENUM('Cash', 'Bank Transfer', 'Mobile Payment', 'Credit', 'Other') DEFAULT 'Cash',
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_dept_id) REFERENCES employees_departments(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Stock Transfers between locations/warehouses
CREATE TABLE IF NOT EXISTS stock_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transfer_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  source_location VARCHAR(100) NOT NULL,
  destination_location VARCHAR(100) NOT NULL,
  transferred_by_id INT,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (transferred_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(100),
  user_role VARCHAR(50),
  action_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(50) DEFAULT '127.0.0.1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Material Requests (Storekeeper or Store Manager submits, Store Manager or Admin approves)
CREATE TABLE IF NOT EXISTS material_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  purpose VARCHAR(255),
  priority ENUM('Low', 'Normal', 'High', 'Urgent') DEFAULT 'Normal',
  remarks TEXT,
  status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  requested_by_id INT,
  approved_by_id INT,
  approval_remarks TEXT,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Material Disposals (Damaged / Expired materials)
CREATE TABLE IF NOT EXISTS material_disposals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  disposal_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  disposal_type ENUM('Damaged', 'Expired', 'Obsolete', 'Other') DEFAULT 'Damaged',
  reason VARCHAR(255),
  remarks TEXT,
  status ENUM('Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
  recorded_by_id INT,
  approved_by_id INT,
  disposal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Warehouses / Locations
CREATE TABLE IF NOT EXISTS warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  manager_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  status ENUM('Draft', 'Issued', 'Partially Received', 'Completed', 'Cancelled') DEFAULT 'Draft',
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  expected_date DATE,
  remarks TEXT,
  created_by_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Purchase Order Line Items
CREATE TABLE IF NOT EXISTS po_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  material_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ── Migrations: add new ENUM values to existing tables ───────
-- These run safely on existing databases (IF NOT EXISTS logic is handled by the MODIFY)
-- Add 'Locked' to users.status and 'Viewer'/'Auditor' to users.role if not already present
ALTER TABLE users MODIFY COLUMN role ENUM('Administrator','Store Manager','Storekeeper','Auditor','Viewer') NOT NULL DEFAULT 'Storekeeper';
ALTER TABLE users MODIFY COLUMN status ENUM('Active','Inactive','Locked') DEFAULT 'Active';
