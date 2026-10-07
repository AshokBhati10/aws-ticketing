<template>
  <TopBar />
  <main class="max-w-2xl mx-auto px-4 py-6">
    <h1 class="text-xl font-bold mb-4">New ticket</h1>
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <form @submit.prevent="submit" class="bg-white rounded shadow p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Title *</label>
        <input v-model="form.title" required maxlength="200"
          class="w-full border rounded px-3 py-2" placeholder="Brief summary" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Description *</label>
        <textarea v-model="form.description" required rows="5"
          class="w-full border rounded px-3 py-2" placeholder="What happened?"></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Priority *</label>
          <select v-model="form.priority" required class="w-full border rounded px-3 py-2">
            <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Category *</label>
          <input v-model="form.category" required maxlength="100" list="categories"
            class="w-full border rounded px-3 py-2" placeholder="e.g. Hardware" />
          <datalist id="categories">
            <option v-for="c in commonCategories" :key="c" :value="c" />
          </datalist>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Attachments (optional, max 10MB each)</label>
        <input type="file" multiple @change="onFiles" class="text-sm" />
        <ul v-if="files.length" class="text-sm text-gray-600 mt-2 list-disc pl-5">
          <li v-for="f in files" :key="f.name">{{ f.name }} ({{ Math.round(f.size / 1024) }} KB)</li>
        </ul>
      </div>
      <div class="flex gap-3">
        <button type="submit" :disabled="submitting"
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {{ submitting ? "Submitting…" : "Create ticket" }}
        </button>
        <router-link to="/" class="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Cancel</router-link>
      </div>
      <p v-if="uploadStatus" class="text-sm text-gray-500">{{ uploadStatus }}</p>
    </form>
  </main>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import TopBar from "../components/TopBar.vue";
import { api } from "../lib/api.js";

const router = useRouter();
const priorities = ["low", "medium", "high", "urgent"];
const commonCategories = ["Hardware", "Software", "Network", "Access", "Billing", "Other"];
const form = reactive({ title: "", description: "", priority: "medium", category: "" });
const files = ref([]);
const submitting = ref(false);
const error = ref("");
const uploadStatus = ref("");

function onFiles(e) {
  files.value = Array.from(e.target.files || []);
}

// Upload each file straight to S3 via a presigned PUT URL (never through Lambda).
async function uploadAttachments() {
  const uploaded = [];
  for (const f of files.value) {
    uploadStatus.value = `Uploading ${f.name}…`;
    const { uploadUrl, key } = await api.presignedUrl({
      fileName: f.name,
      contentType: f.type || "application/octet-stream",
      size: f.size,
    });
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": f.type || "application/octet-stream" },
      body: f,
    });
    if (!res.ok) throw new Error(`Upload failed for ${f.name} (${res.status})`);
    uploaded.push({ key, fileName: f.name, contentType: f.type || "application/octet-stream", size: f.size });
  }
  uploadStatus.value = "";
  return uploaded;
}

async function submit() {
  error.value = "";
  submitting.value = true;
  try {
    const attachments = await uploadAttachments();
    const { ticket } = await api.createTicket({
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      attachments,
    });
    router.push(`/tickets/${ticket.ticketId}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
    uploadStatus.value = "";
  }
}
</script>
