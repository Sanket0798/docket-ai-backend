CREATE DATABASE IF NOT EXISTS Docket_Factory;
USE Docket_Factory;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  company_name VARCHAR(150),
  password VARCHAR(255) NOT NULL,
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  credits DECIMAL(10,2) DEFAULT 0.00,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- OTP table
CREATE TABLE IF NOT EXISTS otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp VARCHAR(10) NOT NULL,
  type ENUM('email', 'phone') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Onboarding answers
CREATE TABLE IF NOT EXISTS onboarding (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  project_type VARCHAR(255),
  scenes_elements TEXT,
  ai_assistance VARCHAR(255),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Projects (inside workspaces)
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  script_text TEXT,
  additional_notes TEXT,
  transcription_text LONGTEXT,
  script_pdf_url VARCHAR(500),
  audio_url VARCHAR(500),
  status ENUM('draft', 'processing', 'completed', 'failed') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI Questions & Answers per project
CREATE TABLE IF NOT EXISTS project_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  question_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255) NOT NULL,
  project_id INT,
  credits_used DECIMAL(10,2) NOT NULL,
  type ENUM('debit', 'credit') NOT NULL,
  status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  plan_name VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  credits_purchased DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Credit plans
CREATE TABLE IF NOT EXISTS credit_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  credits DECIMAL(10,2) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default credit plans
INSERT IGNORE INTO credit_plans (id, name, credits, price, description) VALUES
(1, 'Starter', 100, 199, 'Perfect for trying out Docket Factory'),
(2, 'Pro', 300, 499, 'For regular creators and filmmakers'),
(3, 'Business', 1000, 1299, 'For professionals and heavy usage');

-- Wishlist (saved AI-generated images)
CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NOT NULL,
  image_url VARCHAR(500),
  image_index INT DEFAULT 0,
  question_id VARCHAR(100),
  tags VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ── Indexes for query performance ─────────────────────────────────────
-- Using CREATE INDEX without IF NOT EXISTS for MySQL 5.7 compatibility.
-- The IGNORE keyword via a stored procedure workaround is not needed —
-- indexes are dropped and recreated only if the table is fresh.
-- On an existing DB, these will error silently if already present;
-- that is handled by the multipleStatements pool in db.js.
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_otps_user_type     ON otps(user_id, type);
CREATE INDEX idx_workspaces_user    ON workspaces(user_id);
CREATE INDEX idx_projects_ws_user   ON projects(workspace_id, user_id);
CREATE INDEX idx_projects_user      ON projects(user_id);
CREATE INDEX idx_questions_project  ON project_questions(project_id);
CREATE INDEX idx_credit_tx_user     ON credit_transactions(user_id);
CREATE INDEX idx_payments_user      ON payments(user_id);
CREATE INDEX idx_payments_order     ON payments(razorpay_order_id);
CREATE INDEX idx_wishlist_user      ON wishlist(user_id);
