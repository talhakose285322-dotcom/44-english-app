// Small app-level steps shared by tests (they drive the real UI; the Supabase fake must be loaded).
// Signs in through the e-mail code flow of the fake client (code 123456) and waits for the account panel.
export async function login(b, email = 'test@example.com') {
  await b.ev("document.getElementById('n-prof').click()");
  await b.waitFor("!!document.getElementById('p-em')");
  await b.ev(`(function(e){e.value=${JSON.stringify(email)};e.dispatchEvent(new Event('input'));document.getElementById('p-send').click()})(document.getElementById('p-em'))`);
  await b.waitFor("!!document.getElementById('p-code')");
  await b.ev("document.getElementById('p-code').value='123456';document.getElementById('p-ver').click()");
  await b.waitFor("/Giriş yapıldı/.test(document.getElementById('p-acct').innerText)");
}
export const K = 'kelimelerim-v1', KS = K + '-s', KA = K + '-a';
