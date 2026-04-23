const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (Number.isNaN(major) || major < 20 || major >= 25) {
  console.error(
    [
      "",
      `Unsupported Node.js version: ${process.versions.node}`,
      "Use Node 20, 22, or 24 for this project.",
      "Running with Node 25 can corrupt Next.js dev/build output.",
      "",
    ].join("\n")
  );
  process.exit(1);
}
