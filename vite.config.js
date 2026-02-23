remix({
  buildDirectory: "my-custom-build", 
}),
  export default {
  build: {
    rollupOptions: {
      external: ['package-name', 'another-external']
    }
  }
}
