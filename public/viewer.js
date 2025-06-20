const container = document.getElementById("pdf-container");
const roleSelect = document.getElementById("roleSelect");
const timerDisplay = document.getElementById("timer");
const songNameDisplay = document.getElementById("songName");
const progressBar = document.getElementById("progress-bar");

const displayNames = {
  flowers: "Flowers – A Day to Remember",
  lola: "Lola Montez – Volbeat"
};

let currentSong = "flowers";
let scrollStartTime = null;
let scrollDuration = 0;
let scrollInterval = null;
let timerInterval = null;

// Restore saved role
const savedRole = localStorage.getItem("selectedRole");
if (savedRole) {
  roleSelect.value = savedRole;
}

// Save role on change
roleSelect.addEventListener("change", () => {
  localStorage.setItem("selectedRole", roleSelect.value);
});

const ws = new WebSocket(`ws://${location.host}`);
ws.onopen = () => console.log("WebSocket connected");

ws.onmessage = async (event) => {
  try {
    const rawData = event.data;
    const text = rawData instanceof Blob ? await rawData.text() : rawData;
    const msg = JSON.parse(text);

    if (msg.action === "start" && msg.duration && msg.song && msg.startAt) {
      currentSong = msg.song;
      scrollDuration = msg.duration;
      songNameDisplay.textContent = displayNames[msg.song] || msg.song;

      const role = roleSelect.value;
      const pdfPath = `${currentSong}-${role}.pdf`;

      console.log(`Loading PDF: ${pdfPath}`);
      container.innerHTML = "";

      pdfjsLib.getDocument(pdfPath).promise
        .then(pdf => {
          let rendered = 0;
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            pdf.getPage(pageNum).then(page => {
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              container.appendChild(canvas);

              page.render({ canvasContext: context, viewport }).promise.then(() => {
                rendered++;
                if (rendered === pdf.numPages) {
                  const delay = msg.startAt - Date.now();
                  if (delay > 0) {
                    console.log("Scheduled scroll in", delay, "ms");
                    setTimeout(() => startScrolling(scrollDuration), delay);
                  } else {
                    startScrolling(scrollDuration);
                  }
                }
              });
            });
          }
        })
        .catch(err => console.error("Failed to load PDF:", err));
    }
  } catch (err) {
    console.error("Invalid WebSocket message:", event.data);
  }
};

function startScrolling(durationSeconds) {
  const totalDistance = container.scrollHeight - container.clientHeight;
  const frameRate = 60;
  const totalFrames = durationSeconds * frameRate;
  const step = totalDistance / totalFrames;
  let scrollPosition = 0;

  console.log(`Scrolling ${totalDistance}px over ${durationSeconds}s`);
  scrollStartTime = Date.now();
  clearInterval(scrollInterval);
  clearInterval(timerInterval);

  scrollInterval = setInterval(() => {
    scrollPosition += step;
    container.scrollTop = scrollPosition;

    const elapsed = (Date.now() - scrollStartTime) / 1000;
    const progressPercent = Math.min(100, (elapsed / durationSeconds) * 100);
    progressBar.style.width = `${progressPercent}%`;

    if (scrollPosition >= totalDistance) {
      clearInterval(scrollInterval);
      clearInterval(timerInterval);
      progressBar.style.width = `100%`;
      console.log("Scroll complete");
    }
  }, 1000 / frameRate);

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - scrollStartTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
  }, 500);
}
