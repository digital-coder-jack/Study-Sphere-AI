/* =====================================================================
   Study Sphere AI  -  profile.js  (profile + settings)
   ===================================================================== */



function pmsg(boxId, text, type) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.textContent = text;
  box.className = `form-msg show ${type}`;
}
function busy(btn, on, label) {
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${label}`; }
  else { btn.disabled = false; btn.innerHTML = btn.dataset.html; }
}

async function loadProfile() {
  try {
    const data = await SS.api('/api/auth/me');
    const u = data.user;
    SS.setSession(SS.getToken(), u);
    document.getElementById('pName').textContent = u.name;
    document.getElementById('pEmail').textContent = u.email;
    document.getElementById('pJoined').textContent = u.created_at ? `Joined ${u.created_at.split(' ')[0]}` : '';
    document.getElementById('bigAvatar').textContent = (u.name || 'U').charAt(0).toUpperCase();
    document.getElementById('editName').value = u.name;
    document.getElementById('editEmail').value = u.email;
  } catch (err) {
    SS.toast(err.message, 'error');
  }
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = document.getElementById('profileBtn');
  const name = document.getElementById('editName').value.trim();
  if (!name) return pmsg('profileMsg', 'Name cannot be empty.', 'error');
  busy(btn, true, 'Saving…');
  try {
    const data = await SS.api('/api/auth/profile', { method: 'PUT', body: { name } });
    SS.setSession(SS.getToken(), data.user);
    pmsg('profileMsg', 'Profile updated successfully.', 'success');
    SS.toast('Profile updated!');
    loadProfile();
  } catch (err) {
    pmsg('profileMsg', err.message, 'error');
  } finally {
    busy(btn, false);
  }
}

async function changePassword(e) {
  e.preventDefault();
  const btn = document.getElementById('pwBtn');
  const current_password = document.getElementById('curPw').value;
  const new_password = document.getElementById('newPw').value;
  if (!current_password || !new_password) return pmsg('pwMsg', 'Fill in both fields.', 'error');
  if (new_password.length < 6) return pmsg('pwMsg', 'New password must be at least 6 characters.', 'error');
  busy(btn, true, 'Updating…');
  try {
    const data = await SS.api('/api/auth/change-password', { method: 'PUT', body: { current_password, new_password } });
    pmsg('pwMsg', data.message, 'success');
    SS.toast('Password updated!');
    document.getElementById('curPw').value = '';
    document.getElementById('newPw').value = '';
  } catch (err) {
    pmsg('pwMsg', err.message, 'error');
  } finally {
    busy(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('pwForm').addEventListener('submit', changePassword);
});
