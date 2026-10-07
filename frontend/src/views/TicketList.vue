<template>
  <TopBar />
  <main class="max-w-6xl mx-auto px-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h1 class="text-xl font-bold">Tickets</h1>
      <router-link
        to="/tickets/new"
        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        New ticket
      </router-link>
    </div>

    <div class="flex flex-wrap gap-3 mb-4">
      <label class="flex items-center gap-2 text-sm">
        Status
        <select v-model="filters.status" @change="load" class="border rounded px-2 py-1.5">
          <option value="">All</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm">
        Priority
        <select v-model="filters.priority" @change="load" class="border rounded px-2 py-1.5">
          <option value="">All</option>
          <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <p v-else-if="loading" class="text-gray-500">Loading…</p>
    <p v-else-if="tickets.length === 0" class="text-gray-500">No tickets found.</p>

    <div v-else class="bg-white rounded shadow overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="bg-gray-100 text-left">
            <th class="px-4 py-2">Title</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Priority</th>
            <th class="px-4 py-2">Category</th>
            <th class="px-4 py-2">Assignee</th>
            <th class="px-4 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in tickets"
            :key="t.ticketId"
            class="border-t hover:bg-gray-50 cursor-pointer"
            @click="$router.push(`/tickets/${t.ticketId}`)"
          >
            <td class="px-4 py-2 font-medium text-indigo-700">{{ t.title }}</td>
            <td class="px-4 py-2"><Badge type="status" :value="t.status" /></td>
            <td class="px-4 py-2"><Badge type="priority" :value="t.priority" /></td>
            <td class="px-4 py-2">{{ t.category }}</td>
            <td class="px-4 py-2">{{ t.assignee || "—" }}</td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(t.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!loading" class="text-sm text-gray-500 mt-2">{{ tickets.length }} ticket(s)</p>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import TopBar from "../components/TopBar.vue";
import Badge from "../components/Badge.vue";
import { api } from "../lib/api.js";

const statuses = ["open", "in-progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];
const filters = reactive({ status: "", priority: "" });
const tickets = ref([]);
const loading = ref(true);
const error = ref("");

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.listTickets(filters);
    tickets.value = data.tickets || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
