// Toast helper (dipanggil dari server flash jika perlu)
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  toast.className = `pointer-events-auto px-4 py-3 rounded-xl text-sm font-medium shadow-lg border transition-all ${
    isSuccess
      ? 'bg-green-500/10 border-green-500/20 text-green-400'
      : 'bg-red-500/10 border-red-500/20 text-red-400'
  }`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
