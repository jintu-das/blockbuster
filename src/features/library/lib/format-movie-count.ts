export function formatMovieCount(count: number) {
  return `${count} ${count === 1 ? "movie" : "movies"}`;
}
