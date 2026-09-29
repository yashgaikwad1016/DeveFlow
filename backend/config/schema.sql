-- DevFlow MySQL Schema
-- Run this script once to create all tables.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE DATABASE IF NOT EXISTS devflow;
USE devflow;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Admin','Manager','Member') NOT NULL DEFAULT 'Member',
  designation VARCHAR(255),
  active TINYINT(1) DEFAULT 1,
  must_change TINYINT(1) DEFAULT 0,
  created_at DATETIME,
  last_login DATETIME
);

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  value TEXT
);

INSERT IGNORE INTO settings (`key`, value) VALUES
  ('app_name', 'DevFlow'),
  ('org_name', ''),
  ('hours_per_day', '6');

CREATE TABLE IF NOT EXISTS projects (
  project_id INT AUTO_INCREMENT PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status ENUM('Active','On Hold','Completed') DEFAULT 'Active',
  manager_id INT,
  created_at DATETIME,
  FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  member_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  project_id INT,
  UNIQUE KEY uq_member (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sprints (
  sprint_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  sprint_name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  sprint_id INT,
  project_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority ENUM('High','Medium','Low') DEFAULT 'Medium',
  status ENUM('Pending','In Progress','Completed','Blocked') DEFAULT 'Pending',
  assigned_to INT,
  deadline DATE,
  estimated_hours DOUBLE DEFAULT 4,
  complexity TINYINT DEFAULT 3,
  created_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (sprint_id) REFERENCES sprints(sprint_id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS issues (
  issue_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT,
  project_id INT,
  title VARCHAR(255),
  description TEXT,
  severity ENUM('Low','Medium','High','Critical') DEFAULT 'Medium',
  status ENUM('Open','In Progress','Resolved','Closed') DEFAULT 'Open',
  assigned_to INT,
  reported_by INT,
  screenshot VARCHAR(500),
  created_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT,
  user_id INT,
  message TEXT,
  created_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  message TEXT,
  link VARCHAR(500),
  status ENUM('Unread','Read') DEFAULT 'Unread',
  created_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  uploaded_by INT,
  created_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity (
  activity_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  project_id INT,
  action TEXT,
  created_at DATETIME
);

