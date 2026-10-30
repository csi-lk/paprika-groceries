FROM oven/bun:1.3.14

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /app/.cache && chown -R bun:bun /app

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787
USER bun
CMD ["bun", "src/server.ts"]
