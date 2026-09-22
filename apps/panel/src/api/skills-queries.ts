import { gql } from "@apollo/client/core";

export const SKILLS_QUERY = gql`
  query Skills(
    $query: String
    $category: String
    $page: Int
    $pageSize: Int
    $chinaAvailable: Boolean
  ) {
    skills(
      query: $query
      category: $category
      page: $page
      pageSize: $pageSize
      chinaAvailable: $chinaAvailable
    ) {
      skills {
        slug
        name_en
        name_zh
        desc_en
        desc_zh
        author
        version
        tags
        labels
        chinaAvailable
        stars
        downloads
      }
      total
      page
      pageSize
    }
  }
`;

export const SKILL_CATEGORIES_QUERY = gql`
  query SkillCategories {
    skillCategories {
      id
      name_en
      name_zh
      count
    }
  }
`;
