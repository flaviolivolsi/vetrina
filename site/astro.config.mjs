import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  server: {
    // Deliberately NOT `host: true`. This machine has a public IP on one of its
    // interfaces, and binding every interface would put the dev server straight
    // onto the internet, the exact mistake vetrina.ts refuses to make.
    // To share it, name the interface explicitly:
    //   npx astro dev --host $(tailscale ip -4)
    port: 4321,
  },
});
