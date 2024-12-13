import { APIGatewayProxyHandler } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as redis from "redis";

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_URL}:${process.env.REDIS_PORT}`,
});

const tableName = process.env.POST_TABLE_NAME ?? "Posts"; // Accessing the environment variable
const limit = 10;
const expTime = 110;
const setRedisData = async (pageNumber: string, data: any) => {
  const promiseArr = [
    redisClient.set(`POST:PAGE_${pageNumber}`, JSON.stringify(data),{EX:expTime}),
  ];
  if (data?.LastEvaluatedKey)
    promiseArr.push(
      redisClient.set(
        `POST:LASTKEY_${pageNumber}`,
        JSON.stringify(data?.LastEvaluatedKey),{EX:expTime}
      )
    );
  return await Promise.all(promiseArr);
};
const getRedisData = async (pageNumber: string) => {
  return await redisClient.get(`POST:PAGE_${pageNumber}`);
};

const getRedisLastKey = async (pageNumber: string) => {
  return await redisClient.get(`POST:LASTKEY_${pageNumber}`);
};
const setRedisLastKey = async (pageNumber: string, lastkey) => {
  return await redisClient.set(`POST:LASTKEY_${pageNumber}`, lastkey,{EX:expTime});
};

const getLastKeyByPageNumber = async (pageNumber: string) => {
  const newLimit = (parseInt(pageNumber) - 1) * limit;
  const params = {
    TableName: tableName,
    IndexName: "TypeIndex",
    KeyConditionExpression: "#type = :typeField",
    ExpressionAttributeNames: {
      "#type": "type",
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":typeField": "POST",
    },
    ProjectionExpression: "#id",
    ScanIndexForward: false,
    Limit: newLimit,
  };
  const data = await dynamoDb.query(params).promise();
  console.log(data);
  if (data?.Items?.length === newLimit) {
    await setRedisLastKey((parseInt(pageNumber)-1).toString(), JSON.stringify(data.LastEvaluatedKey));
    return data.LastEvaluatedKey;
  } else return null;
};

const getData = async (pageNumber: string) => {
  const cacheData = await getRedisData(pageNumber);
  console.log(`cache data for pagenumber ${pageNumber} is ${cacheData}`)
  if (cacheData) return JSON.parse(cacheData);
  if (pageNumber == "1") {
    const params = {
      TableName: tableName,
      IndexName: "TypeIndex",
      KeyConditionExpression: "#type = :typeField",
      ExpressionAttributeNames: {
        "#type": "type",
      },
      ExpressionAttributeValues: {
        ":typeField": "POST",
      },
      ScanIndexForward: false,
      Limit: limit,
    };
    const postsData = await dynamoDb.query(params).promise();
    console.log(`data from dynamodb for page ${pageNumber} is : ${postsData}`)
    await setRedisData(pageNumber, postsData);
    return postsData;
  }
  const lastKey =await getRedisLastKey((parseInt(pageNumber) - 1).toString());
  console.log(`lastkey for pageNumber ${pageNumber} from redis is ${lastKey}`)
  if (lastKey) {
    console.log(lastKey,"exists",typeof lastKey)
    const params   = {
      TableName: tableName,
      IndexName: "TypeIndex",
      KeyConditionExpression: "#type = :typeField",
      ExpressionAttributeNames: {
        "#type": "type",
      },
      ExpressionAttributeValues: {
        ":typeField": "POST",
      },
      ScanIndexForward: false,
      ExclusiveStartKey: JSON.parse(lastKey),
      Limit: limit,
    };
    const postsData = await dynamoDb.query(params).promise();
    await setRedisData(pageNumber, postsData);
    return postsData;
  } else {
    const lastKey = await getLastKeyByPageNumber(pageNumber);
    console.log(`get last key from dynamodb is pagenumber ${pageNumber}   ${lastKey}`)
    if (lastKey) {
      const params = {
        TableName: tableName,
        IndexName: "TypeIndex",
        KeyConditionExpression: "#type = :typeField",
        ExpressionAttributeNames: {
          "#type": "type",
        },
        ExpressionAttributeValues: {
          ":typeField": "POST",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
        Limit: limit,
      };
      const postsData = await dynamoDb.query(params).promise();
      await setRedisData(pageNumber, postsData);
      return postsData;
    }
  }
};

export const processor: APIGatewayProxyHandler = async (event) => {
  console.log(event);

  const { page } = event.pathParameters;

  console.log("page number is :", page);
  console.log(
    "redisUrl is :",
    `redis://${process.env.REDIS_URL}:${process.env.REDIS_PORT}`
  );
  if (!redisClient.isOpen) await redisClient.connect();
  if(page==='flush') {
    await redisClient.flushAll()
    return {
      statusCode:200,
      body:"redis flushed"
    }
  }
  if(page==='keys') {
    const keys = await redisClient.keys("*")
    console.log("redis keys is :",keys)
    return {body:JSON.stringify(keys),
      statusCode:200
    }
  }
  console.log("redis connected");
  // check redis for cache
  try {
    const data = await getData(page)
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    }

  } catch (e) {
    console.log(e);
    return {
      statusCode: 500,
      body: JSON.stringify(e),
    };
  }
};
