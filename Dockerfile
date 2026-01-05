FROM node:18-alpine

# Install dependencies for canvas (node-canvas)
RUN apk add --no-cache \
    cairo \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN mkdir -p uploads

EXPOSE 3005

CMD ["node", "dist/main"]