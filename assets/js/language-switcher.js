// assets/js/language-switcher.js
const translations = {
  en: {
    // 这里添加英文文本数据
    "Homepage": "Homepage",
    // 其他需要翻译的文本
  },
  zh: {
    // 这里添加中文文本数据
    "Homepage": "主页",
    // 其他需要翻译的文本
  }
};

let currentLanguage = 'zh';

// 获取语言切换按钮
const languageSwitcher = document.getElementById('language-switcher');

// 切换语言的函数
function switchLanguage() {
  currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
  languageSwitcher.textContent = currentLanguage === 'zh' ? '英文' : '中文';

  // 更新网页上的文本
  const elements = document.querySelectorAll('[data-translate]');
  elements.forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[currentLanguage][key]) {
      element.textContent = translations[currentLanguage][key];
    }
  });
}

// 为按钮添加点击事件监听器
languageSwitcher.addEventListener('click', switchLanguage);

// 初始化页面语言
switchLanguage();
