# TODO: Convert this single-stage image into a lean multi-stage build
FROM node:20-bullseye

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
