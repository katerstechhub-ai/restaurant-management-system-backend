const email = 'admin_test' + Date.now() + '@example.com';
const password = 'password123';
let token = '';

async function test() {
  console.log('Testing endpoints on http://localhost:5000...\n');

  try {
    // 1. Register an admin user
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin Test', email, password, role: 'admin' })
    });
    const regData = await regRes.json();
    if (regRes.ok) {
      token = regData.token;
      console.log('✅ Registered admin user successfully.');
    } else {
      console.log('❌ Register failed:', regData.message);
      return;
    }

    // 2. Test Tables Endpoint
    console.log('\n--- Testing Tables API ---');
    const tableRes = await fetch('http://localhost:5000/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ tableNumber: Math.floor(Math.random() * 100), capacity: 4 })
    });
    console.log('Create Table:', await tableRes.json());

    const getTablesRes = await fetch('http://localhost:5000/api/tables', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Get Tables:', await getTablesRes.json());

    // 3. Test Inventory Endpoint
    console.log('\n--- Testing Inventory API ---');
    const invRes = await fetch('http://localhost:5000/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ itemName: 'Tomatoes ' + Date.now(), quantity: 50, reorderPoint: 20, supplierInfo: 'Fresh Farms' })
    });
    const invData = await invRes.json();
    console.log('Create Inventory:', invData);

    if (invData._id) {
      const updateRes = await fetch(`http://localhost:5000/api/inventory/${invData._id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'subtract', amount: 40 })
      });
      console.log('Update Stock (check server console for low-stock alert):', await updateRes.json());
    }
  } catch (err) {
    console.error('Fetch error:', err.message, '- Is the server running?');
  }
}

test();
