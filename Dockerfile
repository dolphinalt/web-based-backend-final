FROM node:16-alpine
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm i
COPY . .
EXPOSE 10001
CMD [ "npm", "start" ]