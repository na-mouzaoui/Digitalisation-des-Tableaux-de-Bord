export function getRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin"
    case "comptabilite":
      return "Finance"
    case "direction":
      return "Global"
    case "regionale":
      return "Régionale"
    default:
      return role
  }
}
