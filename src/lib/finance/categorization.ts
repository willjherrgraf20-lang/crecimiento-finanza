// Reglas de auto-categorización para bancos chilenos y descripcion general
const RULES: { keywords: string[]; categoryId: string }[] = [
  { keywords: ["uber eats", "rappi", "pedidosya", "junaeb", "mcdonalds", "kfc", "subway", "supermercado", "lider", "jumbo", "unimarc", "santa isabel", "tottus", "acuenta", "mercado", "restaurant", "sushi", "pizz"], categoryId: "alimentacion" },
  { keywords: ["uber", "cabify", "metro", "bip", "bus", "gasolina", "copec", "shell", "repsol", "combustible", "shell", "axion", "bencina"], categoryId: "transporte" },
  { keywords: ["farmacia", "ahumada", "salco", "cruz verde", "clinica", "médico", "doctor", "hospital", "laboratorio", "dentist", "optica"], categoryId: "salud" },
  { keywords: ["netflix", "spotify", "disney", "prime", "hbo", "cinema", "cine", "cinemark", "hoyts", "teatro", "juego", "steam", "playstation", "xbox", "youtube"], categoryId: "entretenimiento" },
  { keywords: ["curso", "udemy", "coursera", "universidad", "colegio", "libro", "escuela", "duolingo", "platzi"], categoryId: "educacion" },
  { keywords: ["arriendo", "alquiler", "hipoteca", "condominio", "administracion", "luz", "agua", "gas", "entel", "movistar", "wom", "claro", "vtr", "gtd"], categoryId: "vivienda" },
  { keywords: ["amazon", "mercadolibre", "ripley", "falabella", "paris", "h&m", "zara", "ropa", "vestuario", "calzado", "zapatilla"], categoryId: "ropa" },
  { keywords: ["apple", "microsoft", "samsung", "tecnologia", "computadora", "computacion", "amazon web", "aws", "google cloud"], categoryId: "tecnologia" },
  { keywords: ["salario", "sueldo", "nomina", "remuneracion", "honorario", "pago mensual", "ingreso", "transferencia recibida", "deposito recibido", "abono"], categoryId: "salario" },
  { keywords: ["btg", "fondo", "inversion", "dividendo", "bono", "fci"], categoryId: "inversiones" },
  { keywords: ["compra", "pago tarjeta", "cuota", "deuda", "credito"], categoryId: "deudas" },
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function inferCategory(description: string): string | null {
  const normalized = normalize(description);
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => normalized.includes(normalize(kw)))) {
      return rule.categoryId;
    }
  }
  return null;
}
