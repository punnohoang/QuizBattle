FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--webpack"]
