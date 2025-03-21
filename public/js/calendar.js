document.addEventListener('DOMContentLoaded', function () {
    let calendarEl = document.getElementById('calendar');
    let calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        editable: false,
        selectable: true,
        events: '/students/schedule', 
        eventClick: function (info) {
            if (confirm(`Remove ${info.event.title}?`)) {
                fetch('/students/schedule/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId: info.event.id, action: "remove" })
                })
                .then(() => info.event.remove())
                .catch(err => console.error(err));
            }
        }
    });
    calendar.render();
});
