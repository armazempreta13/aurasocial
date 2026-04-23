const regex = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*)/g;
const text = "**o que mais te faria usar uma rede social TODO dia?**";
const parts = text.split(regex);
console.log("Parts:", parts);

parts.forEach(part => {
  if (part.startsWith('***') && part.endsWith('***')) {
    console.log("Found bold-italic:", part);
  } else if (part.startsWith('**') && part.endsWith('**')) {
    console.log("Found bold:", part);
  } else if (part.startsWith('*') && part.endsWith('*')) {
    console.log("Found italic:", part);
  } else {
    console.log("Found plain text:", part);
  }
});
