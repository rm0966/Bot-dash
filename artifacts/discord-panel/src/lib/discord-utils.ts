export function getAvatarUrl(id: string, avatar: string | null | undefined, discriminator?: string) {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
  }
  // Default avatar calculation: discriminator % 5, or if modern username (discriminator is '0' or missing), (userId >> 22) % 6
  if (discriminator && discriminator !== "0") {
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(discriminator, 10) % 5}.png`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

export function getGuildIconUrl(id: string, icon: string | null | undefined) {
  if (icon) {
    return `https://cdn.discordapp.com/icons/${id}/${icon}.png`;
  }
  return null;
}
