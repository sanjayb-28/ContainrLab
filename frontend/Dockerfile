FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package.json ]; then npm install; fi

COPY . .

CMD ["npm", "run", "dev"]
