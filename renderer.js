const urlBar = document.getElementById('url-bar');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');

backBtn.addEventListener('click', () => {
  window.electronAPI.goBack();
});

forwardBtn.addEventListener('click', () => {
  window.electronAPI.goForward();
});

urlBar.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    let url = urlBar.value;
    if (!url.includes('://')) {
      url = 'https://' + url;
    }
    window.electronAPI.navigate(url);
  }
});

window.electronAPI.onUrlChanged((url) => {
  urlBar.value = url;
});
