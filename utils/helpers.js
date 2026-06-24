function normalizeCameraPhoto(photoData) {
  if (!photoData || typeof photoData !== 'string') return null;
  const trimmed = photoData.trim();
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(trimmed)) return trimmed;
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) ? `data:image/jpeg;base64,${trimmed.replace(/\s/g, '')}` : null;
}

function formatTime(datetime) {
  if (!datetime) return null;
  const d = new Date(datetime);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
}

function calcWorkHours(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const diff = (new Date(checkout) - new Date(checkin)) / 3600000;
  return diff > 0 ? Math.round(diff * 10) / 10 : 0;
}

function getStatusIcon(status) {
  const icons = {
    'Hadir': '✅',
    'Terlambat': '⏰',
    'Izin': '📋',
    'Sakit': '🤒',
    'Alpha': '❌',
    'Perjalanan Dinas': '✈️',
    'Remote Work': '🏠',
    'Shift Override': '🔄'
  };
  return icons[status] || '📌';
}

function parseHHMM(timeStr) {
  const parts = String(timeStr).split(':');
  return { hours: parseInt(parts[0]), minutes: parseInt(parts[1] || 0) };
}

module.exports = {
  normalizeCameraPhoto,
  formatTime,
  calcWorkHours,
  getStatusIcon,
  parseHHMM
};
