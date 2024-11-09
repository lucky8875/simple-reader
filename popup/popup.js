document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleReader');
  
  // 检查当前标签页的阅读模式状态
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'getState'}, (response) => {
      if (response && response.isEnabled) {
        toggleButton.textContent = '关闭阅读模式';
        toggleButton.classList.add('active');
      } else {
        toggleButton.textContent = '开启阅读模式';
        toggleButton.classList.remove('active');
      }
    });
  });

  // 点击切换按钮
  toggleButton.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggle'}, (response) => {
        if (response.success) {
          const isEnabled = response.isEnabled;
          toggleButton.textContent = isEnabled ? '关闭阅读模式' : '开启阅读模式';
          toggleButton.classList.toggle('active', isEnabled);
        }
      });
    });
  });
}); 