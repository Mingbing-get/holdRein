export function disableBodyTextSelection(): () => void {
  const previousUserSelect = document.body.style.getPropertyValue("user-select");
  const previousWebkitUserSelect =
    document.body.style.getPropertyValue("-webkit-user-select");

  document.body.style.setProperty("user-select", "none");
  document.body.style.setProperty("-webkit-user-select", "none");

  return () => {
    restoreBodyStyleProperty("user-select", previousUserSelect);
    restoreBodyStyleProperty("-webkit-user-select", previousWebkitUserSelect);
  };
}

function restoreBodyStyleProperty(property: string, value: string): void {
  if (value) {
    document.body.style.setProperty(property, value);
    return;
  }

  document.body.style.removeProperty(property);
}
