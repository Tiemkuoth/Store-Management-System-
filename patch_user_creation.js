import fs from 'fs';

const filePath = 'C:\\Users\\TIEMKUOTH\\Desktop\\Store Management System\\server\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace new user creation
const findStr = "const [r] = await getPool().query(\n      'INSERT INTO users (username,password_hash,full_name,email,role,avatar_url,theme_preference) VALUES (?,?,?,?,?,?,?)',\n      [trimmedUsername, hashed, full_name, email, role, avatar_url || null, preference]\n    );";
const replaceStr = `let forceFirstLogin = 1;
    try {
      const [[s]] = await getPool().query("SELECT setting_value FROM system_settings WHERE setting_key='pwd_force_change_first_login'");
      if (s && s.setting_value === 'false') forceFirstLogin = 0;
    } catch {}

    const [r] = await getPool().query(
      'INSERT INTO users (username,password_hash,full_name,email,role,avatar_url,theme_preference,force_password_change) VALUES (?,?,?,?,?,?,?,?)',
      [trimmedUsername, hashed, full_name, email, role, avatar_url || null, preference, forceFirstLogin]
    );
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [r.insertId, hashed]);`;

if (content.includes(findStr)) {
  content = content.replace(findStr, replaceStr);
  fs.writeFileSync(filePath, content);
  console.log('Successfully patched user creation');
} else {
  console.error('Could not find user creation block');
}
