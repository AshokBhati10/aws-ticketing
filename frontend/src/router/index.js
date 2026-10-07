import { createRouter, createWebHistory } from "vue-router";
import TicketList from "../views/TicketList.vue";
import CreateTicket from "../views/CreateTicket.vue";
import TicketDetail from "../views/TicketDetail.vue";
import LoginView from "../views/LoginView.vue";
import CallbackView from "../views/CallbackView.vue";
import { isAuthenticated } from "../lib/auth.js";

const routes = [
  { path: "/login", component: LoginView },
  { path: "/callback", component: CallbackView },
  { path: "/", component: TicketList, meta: { requiresAuth: true } },
  { path: "/tickets/new", component: CreateTicket, meta: { requiresAuth: true } },
  {
    path: "/tickets/:id",
    component: TicketDetail,
    meta: { requiresAuth: true },
    props: true,
  },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) return "/login";
});

export default router;
