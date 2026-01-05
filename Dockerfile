FROM node:18-alpine

RUN apk add --no-cache graphicsmagick ghostscript

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN mkdir -p uploads

EXPOSE 3005

CMD ["node", "dist/main"]