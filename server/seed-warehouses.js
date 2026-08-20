import mysql from 'mysql2/promise';

const pool = await mysql.createPool({
  host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'store_management_db'
});

const warehouses = [
  { code: 'WH001', name: 'Main Warehouse - Addis Ababa',    manager_name: 'Kebede Alemu',    address: 'Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia' },
  { code: 'WH002', name: 'Branch Store - Dire Dawa',        manager_name: 'Fatuma Mohammed', address: 'Sabian District, Dire Dawa, Ethiopia' },
  { code: 'WH003', name: 'Regional Depot - Hawassa',        manager_name: 'Yohannes Tadesse',address: 'Tabor Sub-City, Hawassa, SNNPR, Ethiopia' },
  { code: 'WH004', name: 'Central Store - Juba',            manager_name: 'Akuei Deng Garang',address: 'Gudele Block, Juba, Central Equatoria, South Sudan' },
  { code: 'WH005', name: 'Transit Depot - Nimule',          manager_name: 'Mary Lado Taban', address: 'Nimule Border Town, Eastern Equatoria, South Sudan' },
];

for (const w of warehouses) {
  const [r] = await pool.query(
    'INSERT INTO warehouses (code, name, address, manager_name) VALUES (?, ?, ?, ?)',
    [w.code, w.name, w.address, w.manager_name]
  );
  console.log(`✅ Created: ${w.name} (id: ${r.insertId})`);
}

await pool.end();
console.log('\n✨ Warehouses seeded successfully!');
