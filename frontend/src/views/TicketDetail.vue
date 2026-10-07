<template>
  <TopBar />
  <main class="max-w-4xl mx-auto px-4 py-6">
    <router-link to="/" class="text-sm text-indigo-600 hover:underline">← Back to tickets</router-link>
    <p v-if="error" class="text-red-600 mt-4">{{ error }}</p>
    <p v-else-if="loading" class="text-gray-500 mt-4">Loading…</p>

    <div v-else-if="ticket" class="mt-4 space-y-6">
      <!-- Ticket information -->
      <section class="bg-white rounded shadow p-6">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 class="text-xl font-bold">{{ ticket.title }}</h1>
          <div class="flex gap-2">
            <Badge type="status" :value="ticket.status" />
            <Badge type="priority" :value="ticket.priority" />
          </div>
        </div>
        <p class="text-gray-700 whitespace-pre-wrap mb-4">{{ ticket.description }}</p>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><dt class="text-gray-500">Category</dt><dd class="font-medium">{{ ticket.category }}</dd></div>
          <div><dt class="text-gray-500">Assignee</dt><dd class="font-medium">{{ ticket.assignee || "Unassigned" }}</dd></div>
          <div><dt class="text-gray-500">Customer</dt><dd class="font-medium">{{ ticket.customerEmail }}</dd></div>
          <div><dt class="text-gray-500">Created</dt><dd class="font-medium">{{ formatDate(ticket.createdAt) }}</dd></div>
          <div><dt class="text-gray-500">Updated</dt><dd class="font-medium">{{ formatDate(ticket.updatedAt) }}</dd></div>
          <div><dt class="text-gray-500">Ticket ID</dt><dd class="font-mono text-xs break-all">{{ ticket.ticketId }}</dd></div>
        </dl>
        <div v-if="ticket.attachments && ticket.attachments.length" class="mt-4">
          <h3 class="text-sm font-medium mb-2">Attachments</h3>
          <ul class="text-sm space-y-1">
            <li v-for="a in ticket.attachments" :key="a.key">
              <a :href="a.downloadUrl" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">
                {{ a.fileName }}
              </a>
              <span class="text-gray-500"> ({{ Math.round((a.size || 0) / 1024) }} KB)</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Status / assignee management -->
      <section class="bg-white rounded shadow p-6">
        <h2 class="font-bold mb-3">Manage ticket</h2>
        <p v-if="saveError" class="text-red-600 text-sm mb-2">{{ saveError }}</p>
        <p v-if="saveOk" class="text-green-600 text-sm mb-2">Saved.</p>
        <div class="flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="block text-gray-500 mb-1">Status</span>
            <select v-model="manage.status" class="border rounded px-3 py-2">
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block text-gray-500 mb-1">Assignee</span>
            <input v-model="manage.assignee" placeholder="e.g. agent@example.com"
              class="border rounded px-3 py-2 w-64" />
          </label>
          <button @click="saveManagement" :disabled="saving"
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
            {{ saving ? "Saving…" : "Save" }}
          </button>
        </div>
      </section>

      <!-- Activity timeline -->
      <section class="bg-white rounded shadow p-6">
        <h2 class="font-bold mb-3">Activity</h2>
        <ol v-if="activity.length" class="space-y-3">
          <li v-for="(a, i) in activity" :key="i" class="flex gap-3 text-sm">
            <div class="flex flex-col items-center">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5"></span>
              <span v-if="i < activity.length - 1" class="w-px flex-1 bg-gray-200"></span>
            </div>
            <div>
              <p class="font-medium">{{ actionLabel(a.action) }}</p>
              <p v-if="a.detail" class="text-gray-600">{{ a.detail }}</p>
              <p class="text-gray-400 text-xs">{{ a.byEmail }} · {{ formatDate(a.at) }}</p>
            </div>
          </li>
        </ol>
        <p v-else class="text-gray-500 text-sm">No activity yet.</p>
      </section>

      <!-- Comments -->
      <section class="bg-white rounded shadow p-6">
        <h2 class="font-bold mb-3">Comments</h2>
        <div v-if="comments.length" class="space-y-4 mb-4">
          <div v-for="c in comments" :key="c.commentId" class="border rounded p-3">
            <p class="text-sm whitespace-pre-wrap">{{ c.text }}</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ c.authorEmail }} ({{ c.authorRole }}) · {{ formatDate(c.createdAt) }}
            </p>
          </div>
        </div>
        <p v-else class="text-gray-500 text-sm mb-4">No comments yet.</p>
        <p v-if="commentError" class="text-red-600 text-sm mb-2">{{ commentError }}</p>
        <textarea v-model="newComment" rows="3" placeholder="Write a comment…"
          class="w-full border rounded px-3 py-2 text-sm mb-2"></textarea>
        <button @click="addComment" :disabled="commenting || !newComment.trim()"
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {{ commenting ? "Adding…" : "Add comment" }}
        </button>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import TopBar from "../components/TopBar.vue";
import Badge from "../components/Badge.vue";
import { api } from "../lib/api.js";

const props = defineProps({ id: String });
const statuses = ["open", "in-progress", "resolved", "closed"];

const ticket = ref(null);
const comments = ref([]);
const loading = ref(true);
const error = ref("");
const manage = reactive({ status: "open", assignee: "" });
const saving = ref(false);
const saveError = ref("");
const saveOk = ref(false);
const newComment = ref("");
const commenting = ref(false);
const commentError = ref("");

const activity = computed(() =>
  [...(ticket.value?.activity || [])].sort((a, b) => b.at.localeCompare(a.at))
);

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function actionLabel(action) {
  return {
    created: "Ticket created",
    status_changed: "Status changed",
    assignee_changed: "Assignee changed",
    updated: "Ticket updated",
    comment_added: "Comment added",
  }[action] || action;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.getTicket(props.id);
    ticket.value = data.ticket;
    manage.status = data.ticket.status;
    manage.assignee = data.ticket.assignee || "";
    const c = await api.listComments(props.id);
    comments.value = c.comments || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function saveManagement() {
  saveError.value = "";
  saveOk.value = false;
  saving.value = true;
  try {
    const { ticket: updated } = await api.updateTicket(props.id, {
      status: manage.status,
      assignee: manage.assignee.trim() || null,
    });
    ticket.value = updated;
    saveOk.value = true;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function addComment() {
  commentError.value = "";
  commenting.value = true;
  try {
    const { comment } = await api.addComment(props.id, newComment.value.trim());
    comments.value.push(comment);
    newComment.value = "";
    const data = await api.getTicket(props.id); // refresh activity timeline
    ticket.value = data.ticket;
  } catch (e) {
    commentError.value = e.message;
  } finally {
    commenting.value = false;
  }
}

onMounted(load);
</script>
