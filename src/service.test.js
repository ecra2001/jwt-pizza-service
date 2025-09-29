const request = require('supertest');
const app = require('./service');
const { Role, DB } = require('./database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
  const logoutRes = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toMatchObject({ message: 'logout successful' });
});

test('register missing fields', async () => {
  const res = await request(app).post('/api/auth').send({ name: 'a', email: 'b' });
  expect(res.status).toBe(400);
});

test('create franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);

  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createRes.status).toBe(200);
  expect(createRes.body).toMatchObject({ name: franchise.name });
});

test('create store', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createFranchiseRes.status).toBe(200);
  const franchiseId = createFranchiseRes.body.id;

  const store = { name: randomName(), address: '123 main st', phone: '8015551212' };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(store);
  expect(createStoreRes.status).toBe(200);
  expect(createStoreRes.body).toMatchObject({ name: store.name });
});

test('get franchises', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createFranchiseRes.status).toBe(200);
  
  const getFranchisesRes = await request(app).get('/api/franchise');
  expect(getFranchisesRes.status).toBe(200);
  expect(getFranchisesRes.body.franchises.length).toBeGreaterThan(0);
});

test('get user franchises', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createFranchiseRes.status).toBe(200);
  
  const getUserFranchisesRes = await request(app)
    .get(`/api/franchise/${createFranchiseRes.body.admins[0].id}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);
  expect(getUserFranchisesRes.status).toBe(200);
  expect(getUserFranchisesRes.body.length).toBeGreaterThan(0);
});

test('delete franchise', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createFranchiseRes.status).toBe(200);
  const franchiseId = createFranchiseRes.body.id;
  
  const deleteFranchiseRes = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);
  expect(deleteFranchiseRes.status).toBe(200);
  expect(deleteFranchiseRes.body).toMatchObject({ message: 'franchise deleted' });
});

test('delete store', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
  const franchise = { name: randomName(), admins: [{email: adminUser.email}] };
  const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(franchise);
  expect(createFranchiseRes.status).toBe(200);
  const franchiseId = createFranchiseRes.body.id;

  const store = { name: randomName(), address: '123 main st', phone: '8015551212' };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(store);
  expect(createStoreRes.status).toBe(200);
  const storeId = createStoreRes.body.id;
  
  const deleteStoreRes = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);
  expect(deleteStoreRes.status).toBe(200);
  expect(deleteStoreRes.body).toMatchObject({ message: 'store deleted' });
});

test('add menu item', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  const adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);

  const tempMenu = [{ title: 'Old Item', description: randomName(), image: randomName(), price: 0.10 }];
  const newItem = { title: 'New Item', description: randomName(), image: randomName(), price: 0.10 };

  const addSpy = jest.spyOn(DB, 'addMenuItem').mockImplementation(async (item) => {
    return { ...item, id: newItem.id };
  });
  const getSpy = jest.spyOn(DB, 'getMenu').mockImplementation(async () => {
    return [...tempMenu, { ...newItem }];
  });

  try {
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({ title: newItem.title, description: newItem.description, image: newItem.image, price: newItem.price });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: newItem.title, description: newItem.description, image: newItem.image, price: newItem.price })
    ]));
  } finally {
    addSpy.mockRestore();
    getSpy.mockRestore();
  }
});
  
test('get menu', async () => {
  const tempMenu = [{ title: 'tempItem', description: randomName(), image: randomName(), price: 0.10 }];
  const getSpy = jest.spyOn(DB, 'getMenu').mockImplementation(async () => {
    return [...tempMenu];
  });
  try{
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'tempItem', price: 0.10 })
    ]));
  } finally {
    getSpy.mockRestore();
  }
});

test('create order', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const authToken = loginRes.body.token;
  expectValidJwt(authToken);

  const tempMenu = [ { id: 1, title: 'tempItem', description: 'Veggie', image: randomName(), price: 0.05 } ];
  const fakeOrder = {
    id: 123,
    franchiseId: 1,
    storeId: 1,
    items: [tempMenu[0]]
  };
  const getSpy = jest.spyOn(DB, 'getMenu').mockResolvedValue(tempMenu);
  const createOrderSpy = jest.spyOn(DB, 'addDinerOrder').mockResolvedValue(fakeOrder);
  try {
  const order = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };
  const orderRes = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${authToken}`)
    .send(order);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body).toMatchObject({ order: { franchiseId: 1, storeId: 1 } });
    expect(orderRes.body.order.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: 'Veggie', price: 0.05 })
      ])
    );
    expectValidJwt(orderRes.body.jwt);
    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ email: testUser.email }),
      expect.objectContaining(order)
    );
  } finally {
    getSpy.mockRestore();
    createOrderSpy.mockRestore();
  }
});

test('update user', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);
  const authToken = loginRes.body.token;

  const updatedUser = { name: 'new name', email: randomName() + '@test.com', password: 'new password' };
  const updateRes = await request(app)
    .put(`/api/user/${loginRes.body.user.id}`)
    .set('Authorization', `Bearer ${authToken}`)
    .send(updatedUser);
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user).toMatchObject({ name: updatedUser.name, email: updatedUser.email });
  expectValidJwt(updateRes.body.token);

  const reloginRes = await request(app).put('/api/auth').send({ email: updatedUser.email, password: updatedUser.password });
  expect(reloginRes.status).toBe(200);
  expectValidJwt(reloginRes.body.token);
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}