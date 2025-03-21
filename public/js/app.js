const socket = io();

socket.on('seatUpdate', (data) => {
  document.getElementById('seat-count').innerText = data.availableSeats;
});
