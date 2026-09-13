import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import authRoutes from '../routes/auth.js';
import authController from '../controllers/authController.js';
import { createLoginLimiter } from '../middleware/loginLimiter.js';
import pool from '../db.js';

test('Production registration rejects path variants before querying the database', async t => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { process.env.NODE_ENV = previous; });
  const query = t.mock.method(pool, 'query', () => { throw new Error('Database must not be called'); });
  const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes);
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => server.close());
  for (const path of ['/api/auth/register','/api/auth/register/','/api/auth/REGISTER']) {
    const result=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(result.status,403);
    assert.equal(result.headers.get('cache-control'),'no-store');
  }
  assert.equal(query.mock.callCount(),0);
});

test('Login rejects malformed types and oversized bcrypt input without database work', async t => {
  const query=t.mock.method(pool,'query',()=>{throw new Error('Must not query');});
  for (const body of [{email:{},password:'x'},{email:'x@y.test',password:{}},{email:'x@y.test',password:'a'.repeat(73)}]) {
    const res={status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
    await authController.login({body},res);
    assert.equal(res.code,400);
  }
  assert.equal(query.mock.callCount(),0);
});

test('Failed login throttling applies across trailing slashes and case variants', async t => {
  const app=express(); const router=express.Router();
  router.post('/login',createLoginLimiter({max:2,windowMs:60000}),(req,res)=>res.status(401).json({error:'Invalid credentials'}));
  app.use('/api/auth',router);
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  assert.equal((await fetch(base+'/login',{method:'POST'})).status,401);
  assert.equal((await fetch(base+'/LOGIN/',{method:'POST'})).status,401);
  assert.equal((await fetch(base+'/login/',{method:'POST'})).status,429);
});
