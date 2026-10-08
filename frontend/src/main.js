import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import { initTheme } from "./lib/theme.js";
import "./style.css";

initTheme(); // apply saved/system theme before first render

createApp(App).use(router).mount("#app");
