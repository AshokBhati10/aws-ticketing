<template>
  <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-3xl w-full mx-auto">
    <router-link
      to="/"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-5"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to tickets
    </router-link>

    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Create ticket</h1>
      <p class="text-sm text-slate-500 mt-1">
        Describe your issue and our support team will pick it up.
      </p>
    </div>

    <p v-if="error" class="alert-error mb-4">{{ error }}</p>

    <form @submit.prevent="submit" class="card-pad space-y-5">
      <div>
        <label class="field-label" for="ct-title">Title <span class="text-red-500">*</span></label>
        <input
          id="ct-title"
          v-model="form.title"
          required
          maxlength="200"
          class="input"
          placeholder="Brief summary of the issue"
        />
      </div>

      <div>
        <label class="field-label" for="ct-desc">Description <span class="text-red-500">*</span></label>
        <textarea
          id="ct-desc"
          v-model="form.description"
          required
          rows="5"
          class="textarea"
          placeholder="What happened? Include steps to reproduce if relevant."
        ></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="field-label" for="ct-priority">Priority <span class="text-red-500">*</span></label>
          <select id="ct-priority" v-model="form.priority" required class="select w-full">
            <option v-for="p in priorities" :key="p" :value="p">{{ capitalize(p) }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="ct-category">Category <span class="text-red-500">*</span></label>
          <input
            id="ct-category"
            v-model="form.category"
            required
            maxlength="100"
            list="categories"
            class="input"
            placeholder="e.g. Hardware"
          />
          <datalist id="categories">
            <option v-for="c in commonCategories" :key="c" :value="c" />
          </datalist>
        </div>
      </div>

      <div>
        <span class="field-label">Attachments <span class="font-normal text-slate-500">(optional, max 10MB each)</span></span>
        <label
          class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-6 py-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
        >
          <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span class="text-sm font-medium text-slate-700">Click to choose files</span>
          <span class="text-xs text-slate-500">Files are uploaded directly to secure storage</span>
          <input type="file" multiple @change="onFiles" class="sr-only" />
        </label>

        <ul v-if="files.length" class="mt-3 space-y-2">
          <li v-for="(f, i) in files" :key="f.name + i" class="file-card">
            <svg class="w-8 h-8 text-indigo-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-slate-800 truncate" :title="f.name">{{ f.name }}</span>
              <span class="text-xs text-slate-500">{{ formatSize(f.size) }}</span>
            </span>
            <button
              type="button"
              @click="removeFile(i)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              aria-label="Remove file"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        </ul>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 pt-1">
        <button type="submit" :disabled="submitting" class="btn btn-primary flex-1 sm:flex-none sm:px-8">
          <span v-if="submitting" class="spinner !w-4 !h-4 !border-white/40 !border-t-white"></span>
          {{ submitting ? uploadStatus || "Creating…" : "Create ticket" }}
        </button>
        <router-link to="/" class="btn btn-secondary flex-1 sm:flex-none">Cancel</router-link>
      </div>
      <p v-if="submitting && uploadStatus" class="text-sm text-slate-500 flex items-center gap-2">
        <span class="spinner"></span>{{ uploadStatus }}
      </p>
    </form>
  </main>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api.js";

const router = useRouter();
const priorities = ["low", "medium", "high", "urgent"];
const commonCategories = ["Hardware", "Software", "Network", "Access", "Billing", "Other"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file (mirrors the backend limit)

const form = reactive({ title: "", description: "", priority: "medium", category: "" });
const files = ref([]);
const submitting = ref(false);
const error = ref("");
const uploadStatus = ref("");

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatSize(bytes) {
  const kb = Math.round((bytes || 0) / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function onFiles(e) {
  const picked = Array.from(e.target.files || []);
  const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
  if (tooBig.length) {
    error.value = `These files exceed the 10MB limit: ${tooBig.map((f) => f.name).join(", ")}`;
    e.target.value = "";
    return;
  }
  error.value = "";
  files.value = picked;
}

function removeFile(i) {
  files.value.splice(i, 1);
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
