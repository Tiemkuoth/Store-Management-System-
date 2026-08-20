import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generate() {
  const now = new Date().toISOString();

  const adminHash    = await bcrypt.hash('Admin@123',   10);
  const managerHash  = await bcrypt.hash('Manager@123', 10);
  const keeperHash   = await bcrypt.hash('Keeper@123',  10);
  const auditorHash  = await bcrypt.hash('Auditor@123', 10);
  const viewerHash   = await bcrypt.hash('Viewer@123',  10);

  const store = {
    meta: {
      nextId: {
        users: 6, categories: 8, suppliers: 5, employees_departments: 6,
        materials: 11, stock_transactions: 4, stock_transfers: 1,
        audit_logs: 4, system_settings: 1, material_requests: 1,
        material_disposals: 1, password_history: 6
      }
    },
    users: [
      { id: 1, username: 'admin',    password_hash: adminHash,   full_name: 'System Administrator', email: 'admin@company.com',   role: 'Administrator', status: 'Active', avatar_url: null, theme_preference: 'Light', failed_login_attempts: 0, locked_until: null, force_password_change: false, created_at: now },
      { id: 2, username: 'manager1', password_hash: managerHash, full_name: 'John Manager',          email: 'manager@company.com', role: 'Store Manager', status: 'Active', avatar_url: null, theme_preference: 'Light', failed_login_attempts: 0, locked_until: null, force_password_change: false, created_at: now },
      { id: 3, username: 'keeper1',  password_hash: keeperHash,  full_name: 'Sarah Keeper',          email: 'keeper@company.com',  role: 'Storekeeper',   status: 'Active', avatar_url: null, theme_preference: 'Light', failed_login_attempts: 0, locked_until: null, force_password_change: false, created_at: now },
      { id: 4, username: 'auditor1', password_hash: auditorHash, full_name: 'Mike Auditor',          email: 'auditor@company.com', role: 'Auditor',       status: 'Active', avatar_url: null, theme_preference: 'Light', failed_login_attempts: 0, locked_until: null, force_password_change: false, created_at: now },
      { id: 5, username: 'viewer1',  password_hash: viewerHash,  full_name: 'Jane Viewer',           email: 'viewer@company.com',  role: 'Viewer',        status: 'Active', avatar_url: null, theme_preference: 'Light', failed_login_attempts: 0, locked_until: null, force_password_change: false, created_at: now }
    ],
    password_history: [
      { id: 1, user_id: 1, password_hash: adminHash,   created_at: now },
      { id: 2, user_id: 2, password_hash: managerHash, created_at: now },
      { id: 3, user_id: 3, password_hash: keeperHash,  created_at: now },
      { id: 4, user_id: 4, password_hash: auditorHash, created_at: now },
      { id: 5, user_id: 5, password_hash: viewerHash,  created_at: now }
    ],
    categories: [
      { id: 1, name: 'Office Supplies',     description: 'General office supplies and stationery', created_at: now },
      { id: 2, name: 'Electronics',         description: 'Electronic devices and accessories',     created_at: now },
      { id: 3, name: 'Furniture',           description: 'Office furniture and fixtures',          created_at: now },
      { id: 4, name: 'Cleaning Supplies',   description: 'Cleaning materials and equipment',      created_at: now },
      { id: 5, name: 'Safety Equipment',    description: 'Safety gear and protective equipment',  created_at: now },
      { id: 6, name: 'Tools',               description: 'Hand tools and power tools',            created_at: now },
      { id: 7, name: 'Packaging Materials', description: 'Boxes, tape, and packaging supplies',  created_at: now }
    ],
    suppliers: [
      { id: 1, supplier_code: 'SUP001', name: 'Addis Trading PLC',         contact_person: 'Abebe Girma',       email: 'abebe@addistrading.et',    phone: '+251-911-234567', address: 'Bole Road, Addis Ababa, Ethiopia',          created_at: now },
      { id: 2, supplier_code: 'SUP002', name: 'Ethio Tech Supplies',        contact_person: 'Tigist Haile',      email: 'tigist@ethiotech.et',      phone: '+251-912-345678', address: 'Piassa, Addis Ababa, Ethiopia',             created_at: now },
      { id: 3, supplier_code: 'SUP003', name: 'Juba Office Mart',           contact_person: 'Deng Akol Garang',  email: 'deng@jubaofficemart.ss',   phone: '+211-912-345678', address: 'Juba Town, Central Equatoria, South Sudan', created_at: now },
      { id: 4, supplier_code: 'SUP004', name: 'Nile General Supplies',      contact_person: 'Ayen Dut Majok',    email: 'ayen@nilesupplies.ss',     phone: '+211-955-123456', address: 'Malakal, Upper Nile State, South Sudan',    created_at: now }
    ],
    employees_departments: [
      { id: 1, type: 'Department', code: 'DEPT001', name: 'IT Department',      department_name: 'Information Technology', contact_number: '+251-911-100001', email: 'it@company.et',      created_at: now },
      { id: 2, type: 'Department', code: 'DEPT002', name: 'HR Department',      department_name: 'Human Resources',        contact_number: '+251-911-100002', email: 'hr@company.et',      created_at: now },
      { id: 3, type: 'Department', code: 'DEPT003', name: 'Finance Department', department_name: 'Finance & Accounting',   contact_number: '+251-911-100003', email: 'finance@company.et', created_at: now },
      { id: 4, type: 'Employee',   code: 'EMP001',  name: 'Dawit Bekele',       department_name: 'Operations',             contact_number: '+251-912-200001', email: 'dawit.bekele@company.et',   created_at: now },
      { id: 5, type: 'Employee',   code: 'EMP002',  name: 'Liya Tesfaye',       department_name: 'Sales',                  contact_number: '+251-913-200002', email: 'liya.tesfaye@company.et',   created_at: now }
    ],
    materials: [
      { id: 1,  material_code: 'MAT001', name: 'A4 Copy Paper (Ream)',      category_id: 1, unit_of_measure: 'Ream',   specifications: '500 sheets, 80gsm white paper',               min_stock_level: 20, current_stock: 50,  unit_cost: 5.99,   supplier_id: 1, location: 'Main Warehouse', barcode: '1234567890001', created_at: now, updated_at: now },
      { id: 2,  material_code: 'MAT002', name: 'Ballpoint Pens (Box)',      category_id: 1, unit_of_measure: 'Box',    specifications: 'Blue ink, 50 pens per box',                   min_stock_level: 10, current_stock: 25,  unit_cost: 12.50,  supplier_id: 1, location: 'Main Warehouse', barcode: '1234567890002', created_at: now, updated_at: now },
      { id: 3,  material_code: 'MAT003', name: 'Wireless Mouse',            category_id: 2, unit_of_measure: 'Pcs',    specifications: '2.4GHz wireless, USB receiver included',      min_stock_level: 5,  current_stock: 15,  unit_cost: 24.99,  supplier_id: 2, location: 'Main Warehouse', barcode: '1234567890003', created_at: now, updated_at: now },
      { id: 4,  material_code: 'MAT004', name: 'Office Chair',              category_id: 3, unit_of_measure: 'Pcs',    specifications: 'Ergonomic, adjustable height, black leather',  min_stock_level: 2,  current_stock: 8,   unit_cost: 149.99, supplier_id: 3, location: 'Main Warehouse', barcode: '1234567890004', created_at: now, updated_at: now },
      { id: 5,  material_code: 'MAT005', name: 'Desk Lamp',                 category_id: 2, unit_of_measure: 'Pcs',    specifications: 'LED, adjustable arm, USB powered',             min_stock_level: 3,  current_stock: 12,  unit_cost: 34.99,  supplier_id: 2, location: 'Main Warehouse', barcode: '1234567890005', created_at: now, updated_at: now },
      { id: 6,  material_code: 'MAT006', name: 'Hand Sanitizer (500ml)',    category_id: 4, unit_of_measure: 'Bottle',  specifications: '70% alcohol, antibacterial',                   min_stock_level: 15, current_stock: 40,  unit_cost: 8.99,   supplier_id: 4, location: 'Main Warehouse', barcode: '1234567890006', created_at: now, updated_at: now },
      { id: 7,  material_code: 'MAT007', name: 'Safety Gloves (Pair)',      category_id: 5, unit_of_measure: 'Pair',    specifications: 'Cut-resistant, size L',                        min_stock_level: 10, current_stock: 30,  unit_cost: 6.50,   supplier_id: 4, location: 'Main Warehouse', barcode: '1234567890007', created_at: now, updated_at: now },
      { id: 8,  material_code: 'MAT008', name: 'Staplers',                  category_id: 1, unit_of_measure: 'Pcs',    specifications: 'Standard size, metal construction',            min_stock_level: 5,  current_stock: 18,  unit_cost: 9.99,   supplier_id: 1, location: 'Main Warehouse', barcode: '1234567890008', created_at: now, updated_at: now },
      { id: 9,  material_code: 'MAT009', name: 'Filing Cabinet (4-drawer)', category_id: 3, unit_of_measure: 'Pcs',    specifications: 'Steel, lockable, grey',                        min_stock_level: 1,  current_stock: 4,   unit_cost: 299.99, supplier_id: 3, location: 'Main Warehouse', barcode: '1234567890009', created_at: now, updated_at: now },
      { id: 10, material_code: 'MAT010', name: 'Whiteboard Markers (Set)',  category_id: 1, unit_of_measure: 'Set',    specifications: 'Assorted colors, dry-erase, 6 pack',           min_stock_level: 8,  current_stock: 22,  unit_cost: 7.49,   supplier_id: 1, location: 'Main Warehouse', barcode: '1234567890010', created_at: now, updated_at: now }
    ],
    stock_transactions: [],
    stock_transfers: [],
    audit_logs: [],
    system_settings: [],
    material_requests: [],
    material_disposals: [],
    warehouses: [
      { id: 1, code: 'WH001', name: 'Main Warehouse - Addis Ababa', manager_name: 'Kebede Alemu',     address: 'Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia',                created_at: now },
      { id: 2, code: 'WH002', name: 'Branch Store - Dire Dawa',     manager_name: 'Fatuma Mohammed',  address: 'Sabian District, Dire Dawa, Ethiopia',                           created_at: now },
      { id: 3, code: 'WH003', name: 'Regional Depot - Hawassa',     manager_name: 'Yohannes Tadesse', address: 'Tabor Sub-City, Hawassa, SNNPR, Ethiopia',                       created_at: now },
      { id: 4, code: 'WH004', name: 'Central Store - Juba',         manager_name: 'Akuei Deng Garang',address: 'Gudele Block, Juba, Central Equatoria, South Sudan',             created_at: now },
      { id: 5, code: 'WH005', name: 'Transit Depot - Nimule',       manager_name: 'Mary Lado Taban',  address: 'Nimule Border Town, Eastern Equatoria, South Sudan',             created_at: now }
    ]
  };

  const outPath = path.join(__dirname, 'db', 'fallback-store.json');
  fs.writeFileSync(outPath, JSON.stringify(store, null, 2), 'utf8');

  console.log('✅ fallback-store.json written to server/db/');
  console.log('Users:     ' + store.users.length);
  console.log('Materials: ' + store.materials.length);
  store.users.forEach(u => console.log(`  ${u.role.padEnd(20)} ${u.username}`));
}

generate().catch(e => { console.error(e); process.exit(1); });
