FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Fix permissions for the node user
RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["npm", "start"]
