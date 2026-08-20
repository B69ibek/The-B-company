const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');
const btn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    await TBC.clientLogin(username, password);
    window.location.href = '/client-dashboard.html';
  } catch (err) {
    msg.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});
