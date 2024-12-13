import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
const postsNumber = parseInt(process.argv[2]) ?? 100
const dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'eu-west-1',  
  });

const TABLE_NAME = 'Posts-dev';

const generateContent = (index: number) => {
  return `This is the content for post number ${index}.`;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generatePosts = async () => {
  let i = 1;  
  do {
    const post = {
      id: `POST_${uuidv4()}`,  
      type:'POST',
      content: generateContent(i),
      timestamp: new Date().toISOString(),  
    };

    const params = {
      TableName: TABLE_NAME,
      Item: post,
    };

    try {
      await dynamoDb.put(params).promise();
      console.log(`Successfully inserted post ${i} into DynamoDB.`); 
    } catch (error) {
      console.error(`Error inserting post ${i} into DynamoDB:`, error);
    }

    i++;  

    // Wait for 0.5 second before inserting the next post
    await delay(500);

  } while (i <= postsNumber);  
};

generatePosts();
