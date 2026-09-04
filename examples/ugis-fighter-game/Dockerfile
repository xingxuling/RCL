FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", "server.mjs"]
