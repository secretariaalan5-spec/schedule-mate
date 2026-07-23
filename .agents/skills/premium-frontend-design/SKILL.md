---
name: premium-frontend-design
description: Guidelines and instructions for creating state-of-the-art premium medical system layouts and mobile-first responsive dashboards.
---

# Premium Frontend Design Skill

This skill provides advanced guidelines for designing modern, beautiful, and highly functional Web and Mobile interfaces for medical and scheduling systems.

## Design Principles

### 1. Visual Aesthetics & Premium Theme
- **Color Palettes:** Avoid solid, harsh primary colors. Use smooth gradients and soft backdrops.
- **Glassmorphism:** Use `backdrop-blur-md` along with translucent borders (e.g., `bg-white/80 dark:bg-slate-900/80 border-slate-100/50`) to create depth.
- **Typography:** Prioritize clean Sans-Serif fonts (like Inter, Outfit, or Roboto) with strict hierarchy.
- **Soft Shadows:** Use layered, diffuse shadows (`shadow-xl shadow-slate-200/50`) instead of dark, harsh ones.

### 2. Mobile-First Responsiveness
- **Floating Navigation Dock:** On mobile devices, use bottom floating docks with rounded pill shapes (`rounded-2xl`) and blur backdrops rather than classic full-width bars.
- **Touch Targets:** Make sure buttons and list items are easily clickable on mobile (minimum height `h-11` or `h-12` for primary buttons).
- **Smooth View Transitions:** Utilize page enter animations (`animate-in fade-in slide-in-from-right-4`) to make transitions feel fluid and native.

### 3. Medical Dashboards Best Practices
- **Visual Status Badges:** Use soft color tags with matching icons for status indication (e.g., light red for overdue, light green for confirmed/done, light amber for warnings).
- **Action Consolidation:** Merge secondary actions into clean dropdown menus or group them into simple, descriptive icon buttons to save space.
- **Responsive Tables:** Replace large desktop tables with interactive card grids on smaller mobile screens.
