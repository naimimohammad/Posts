# Serverless Template 

This serverless template create a lambda function with apigateway and dynamodb and elasticCache .




## Use Cases
- send GET request to /posts/{pageNumber} to fetch posts in specific page the data has been sorted reversed 
- send GET request with /posts/flush with be flush the cache (for debuging).
- send GET request /posts/keys will returns redis keys (for debuging). 

## Setup
1. Install serverless - ```npm install -g serverless```
2. Install dependency - ```npm i```
3. Depoy Stack - ```npm run deploy-dev```

## Generate Dumy post
run ```npm run generate -- 1000``` the 1000 is number of posts, default value is 100


### Tehnical Details 
- number of item in page has been hardcoded to 10 items per page
- redis cache exp time hardcoded to 110 second

### code description 
for handling the sort another GSI added as type 
for caching first we check the result of page of cache with redis Key of **POST:PAGE_5** for example for page one 
if not exits check the redis for lask key by **POST:LASTKEY_4** and if exists send dynamodb query if not exists send a dynamodb query with projection only id to decrese size of returnd data with limit number for ```(page-1)*10``` and get lastKey and set in redis for last Key and request new dynamodb to fetch data for page number 5 



### note
for handling millions number of posts in table this code need more modifiaction to find lastKey , and optimize that because the query to find lastkey encounter to max limit response of dynamodb and we need to repeate it till fetching exact lastKey but at this time I ignore that