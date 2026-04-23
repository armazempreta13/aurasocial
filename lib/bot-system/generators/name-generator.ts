// Name Generator for Bot System

export const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carlos', 'Diana', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena',
  'Igor', 'Julia', 'Kevin', 'Laura', 'Marco', 'Natalia', 'Oscar', 'Patricia',
  'Quentin', 'Rafael', 'Sandra', 'Thiago', 'Ursula', 'Victor', 'Wanda', 'Xavier',
  'Yasmin', 'Zoe', 'Andre', 'Beatriz', 'Camila', 'Diego', 'Elaine', 'Felipe',
  'Giulia', 'Hugo', 'Iris', 'Joao', 'Katerina', 'Luis', 'Mariana', 'Nora',
];

export const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Pereira', 'Martins', 'Rocha', 'Costa', 'Alves',
  'Gomes', 'Mendes', 'Ferreira', 'Sousa', 'Barbosa', 'Carvalho', 'Ribeiro', 'Nunes',
  'Dias', 'Campos', 'Lopes', 'Machado', 'Monteiro', 'Teixeira', 'Correia', 'Simoes',
  'Tavares', 'Marques', 'Soares', 'Duarte', 'Guimaraes', 'Antunes', 'Leal', 'Vieira',
];

export const PROFESSIONS = [
  'Designer', 'Developer', 'Entrepreneur', 'Marketer', 'Engineer',
  'Student', 'Freelancer', 'CEO', 'Manager', 'Analyst',
  'Creator', 'Consultant', 'Investor', 'Artist', 'Writer',
  'Photographer', 'Teacher', 'Researcher', 'Founder', 'Advisor',
];

export const BIO_TEMPLATES = [
  '🚀 {{profession}} | Passionate about {{interest}}',
  '💡 {{profession}} exploring {{interest}}',
  '🎯 {{profession}} focused on {{interest}}',
  '{{interest}} enthusiast | {{profession}}',
  '{{profession}} by day, {{interest}} lover by night 🌙',
  'Building things with {{interest}} 🛠️',
  '{{profession}} | {{interest}} | Community-driven',
  'Always learning. Currently exploring {{interest}}',
];

export function generateBotName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

export function generateUsername(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)].toLowerCase();
  const num = Math.floor(Math.random() * 1000);
  const separators = ['', '_', '.'];
  const sep = separators[Math.floor(Math.random() * separators.length)];
  return `${firstName}${sep}${lastName}${num > 99 ? num : ''}`;
}

export function generateBio(): string {
  const profession = PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
  const interest = INTERESTS[Math.floor(Math.random() * INTERESTS.length)];
  const template = BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)];
  return template
    .replace('{{profession}}', profession)
    .replace('{{interest}}', interest);
}

const INTERESTS = [
  'tecnologia', 'programação', 'design', 'marketing', 'negócios',
  'startups', 'inovação', 'fotografia', 'viagens', 'lifestyle',
  'fitness', 'educação', 'gaming', 'música', 'arte',
];
