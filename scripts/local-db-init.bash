for file in migrations/*.sql; do
  npx wrangler d1 execute DB --local --file="$file"
done